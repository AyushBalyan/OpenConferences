"""Release gates. Standard-library only; tests never contact GitHub or production."""

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def sha(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{40}", value):
        raise ValueError("Expected a full lowercase 40-character commit SHA")
    return value


def positive_id(value):
    if isinstance(value, bool) or not str(value).isdigit() or int(value) < 1:
        raise ValueError("Expected a positive workflow run ID/attempt")
    return int(value)


def assert_current(candidate, main_sha):
    if sha(candidate) != sha(main_sha):
        raise ValueError("Release is stale: main has advanced. Build the current main commit.")


def validate_run(run, name, repository):
    if (not isinstance(run, dict) or run.get("name") != name or run.get("status") != "completed"
            or run.get("conclusion") != "success" or run.get("head_branch") != "main"
            or run.get("head_repository", {}).get("full_name") != repository):
        raise ValueError(f"Expected a successful {name} run from this repository's main branch")
    positive_id(run.get("id"))
    positive_id(run.get("run_attempt"))


def select_build(event_name, event, repository, ref, head_sha, main_sha, ci_runs=()):
    if event_name == "workflow_run":
        run = event["workflow_run"]
        validate_run(run, "CI", repository)
        if run.get("event") != "push":
            raise ValueError("Only push CI can start an automatic production build")
        candidate = sha(run.get("head_sha"))
    elif event_name == "workflow_dispatch" and ref == "refs/heads/main":
        candidate = sha(head_sha)
        matching = [run for run in ci_runs if run.get("head_sha") == candidate
                    and run.get("head_branch") == "main" and run.get("event") == "push"]
        if not matching:
            raise ValueError("Run CI successfully for this main commit before building images")
        # An older green run must not hide a newer failed/in-progress run.
        run = max(matching, key=lambda item: positive_id(item.get("id")))
        validate_run(run, "CI", repository)
    else:
        raise ValueError("Production image builds must run from main")
    assert_current(candidate, main_sha)
    return candidate


def validate_images(images):
    if not isinstance(images, dict) or set(images) != {"api", "worker"}:
        raise ValueError("Release must include both api and worker image digests")
    for digest in images.values():
        if not isinstance(digest, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
            raise ValueError("Invalid image digest in release marker")


def build_marker(repository, head_sha, run_id, attempt, image_records):
    images = {}
    for image in ("api", "worker"):
        record = image_records[image]
        if record.get("image") != image or record.get("sha") != sha(head_sha):
            raise ValueError("Image metadata does not match the release commit/image")
        images[image] = record.get("digest")
    validate_images(images)
    return {"schemaVersion": 1, "stage": "built", "repository": repository,
            "sha": sha(head_sha), "branch": "main", "images": images,
            "build": {"runId": positive_id(run_id), "attempt": positive_id(attempt)}}


def validate_marker(marker, stage, repository, source_run, main_sha):
    if (not isinstance(marker, dict) or type(marker.get("schemaVersion")) is not int
            or marker.get("schemaVersion") != 1 or marker.get("stage") != stage
            or marker.get("repository") != repository or marker.get("branch") != "main"):
        raise ValueError("Missing, incompatible or incorrect release marker; run Build Images again")
    assert_current(marker.get("sha"), main_sha)
    validate_images(marker.get("images"))
    build = marker.get("build", {})
    positive_id(build.get("runId"))
    positive_id(build.get("attempt"))
    key, workflow = ("build", "Build Images") if stage == "built" else ("promotion", "Push Images")
    validate_run(source_run, workflow, repository)
    provenance = marker.get(key, {})
    if (positive_id(provenance.get("runId")) != positive_id(source_run.get("id"))
            or positive_id(provenance.get("attempt")) != positive_id(source_run.get("run_attempt"))):
        raise ValueError("Release artifact belongs to a different workflow run/attempt")
    if sha(source_run.get("head_sha")) != marker["sha"]:
        raise ValueError("Release artifact commit does not match its source workflow")
    return marker


def verify_images(marker, repository, tags):
    validate_images(marker.get("images"))
    for image, expected in marker["images"].items():
        base = f"ghcr.io/{repository.lower()}/{image}"
        refs = [f"{base}:{tag}" for tag in tags] if tags else [f"{base}@{expected}"]
        for ref in refs:
            result = subprocess.run(
                ["docker", "buildx", "imagetools", "inspect", ref, "--format", "{{json .Manifest}}"],
                check=True, capture_output=True, text=True,
            )
            if json.loads(result.stdout).get("digest") != expected:
                raise ValueError(f"{image} tag/digest mismatch: refusing to deploy different images")


def read_json(path):
    value = json.loads(Path(path).read_text())
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def save_marker(marker):
    path = Path("release/image-release.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(marker, indent=2) + "\n")


def output(values, message):
    with open(os.environ["GITHUB_OUTPUT"], "a") as handle:
        for key, value in values.items():
            handle.write(f"{key}={value}\n")
    print(message)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as handle:
            handle.write(message + "\n\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["select-build", "write-build", "promote", "deploy",
                                            "verify-images", "assert-current"])
    parser.add_argument("--tags", nargs="*", choices=["main", "latest"], default=[])
    args = parser.parse_args()
    env = os.environ
    repository = env["GITHUB_REPOSITORY"]
    if args.command == "select-build":
        event = read_json(env["GITHUB_EVENT_PATH"])
        runs = read_json("ci-runs.json").get("workflow_runs", []) if Path("ci-runs.json").exists() else []
        candidate = select_build(env["GITHUB_EVENT_NAME"], event, repository, env["GITHUB_REF"],
                                 env["GITHUB_SHA"], env["CURRENT_MAIN_SHA"], runs)
        output({"sha": candidate, "branch": "main"},
               f"Build both images for tested commit `{candidate}`. All successful main CI runs build, including test-only fixes.")
    elif args.command == "write-build":
        records = {image: read_json(f"image-digests/{image}.json") for image in ("api", "worker")}
        marker = build_marker(repository, env["HEAD_SHA"], env["GITHUB_RUN_ID"],
                              env["GITHUB_RUN_ATTEMPT"], records)
        save_marker(marker)
        print(json.dumps(marker))
    elif args.command == "assert-current":
        assert_current(env["HEAD_SHA"], env["CURRENT_MAIN_SHA"])
    else:
        marker = read_json("release/image-release.json")
        if args.command == "verify-images":
            verify_images(marker, repository, args.tags)
            return
        if env["GITHUB_EVENT_NAME"] == "workflow_dispatch" and env["GITHUB_REF"] != "refs/heads/main":
            raise ValueError("Manual production releases must run from main")
        stage = "built" if args.command == "promote" else "promoted"
        validate_marker(marker, stage, repository, read_json("source-run.json"), env["CURRENT_MAIN_SHA"])
        if args.command == "promote":
            marker = {**marker, "stage": "promoted", "promotion": {
                "runId": positive_id(env["GITHUB_RUN_ID"]),
                "attempt": positive_id(env["GITHUB_RUN_ATTEMPT"]),
            }}
            save_marker(marker)
        output({"sha": marker["sha"], "api_digest": marker["images"]["api"],
                "worker_digest": marker["images"]["worker"]},
               f"Validated {args.command} for `{marker['sha']}` with both recorded image digests.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as error:
        message = f"Release blocked: {error}"
        print(f"::error::{message}", file=sys.stderr)
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as handle:
                handle.write(message + "\n")
        sys.exit(1)
