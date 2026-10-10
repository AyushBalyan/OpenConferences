import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from release import (assert_current, build_marker, select_build, validate_marker,
                     verify_images)

REPO = "Example/OpenConferences"
SHA = "a" * 40
NEW_SHA = "b" * 40
DIGESTS = {"api": "sha256:" + "1" * 64, "worker": "sha256:" + "2" * 64}


def run(name="CI", run_id=100, attempt=1, **changes):
    return {"name": name, "id": run_id, "run_attempt": attempt, "head_sha": SHA,
            "head_branch": "main", "head_repository": {"full_name": REPO},
            "status": "completed", "conclusion": "success", "event": "push", **changes}


def marker():
    return build_marker(REPO, SHA, 200, 1, {
        image: {"image": image, "sha": SHA, "digest": digest}
        for image, digest in DIGESTS.items()
    })


class BuildTests(unittest.TestCase):
    def test_green_ci_builds_complete_commit_even_after_test_only_repair(self):
        # Selection intentionally has no changed-files or HEAD^ input.
        self.assertEqual(select_build("workflow_run", {"workflow_run": run()}, REPO,
                                     "refs/heads/main", SHA, SHA), SHA)

    def test_failed_cancelled_or_foreign_ci_cannot_build(self):
        for changes in ({"conclusion": "failure"}, {"conclusion": "cancelled"},
                        {"event": "pull_request"}, {"head_branch": "feature"},
                        {"head_repository": {"full_name": "Other/Repo"}}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                select_build("workflow_run", {"workflow_run": run(**changes)}, REPO,
                             "refs/heads/main", SHA, SHA)

    def test_older_success_cannot_build_after_main_advances(self):
        with self.assertRaisesRegex(ValueError, "stale"):
            select_build("workflow_run", {"workflow_run": run()}, REPO,
                         "refs/heads/main", SHA, NEW_SHA)

    def test_manual_build_requires_green_ci_for_exact_main_commit(self):
        self.assertEqual(select_build("workflow_dispatch", {}, REPO, "refs/heads/main",
                                     SHA, SHA, [run()]), SHA)
        for runs in ([], [run(head_sha=NEW_SHA)], [run(conclusion="failure")],
                     [run(), run(run_id=101, status="in_progress", conclusion=None)],
                     [run(), run(run_id=101, conclusion="failure")]):
            with self.subTest(runs=runs), self.assertRaises(ValueError):
                select_build("workflow_dispatch", {}, REPO, "refs/heads/main", SHA, SHA, runs)
        with self.assertRaises(ValueError):
            select_build("workflow_dispatch", {}, REPO, "refs/heads/feature", SHA, SHA, [run()])

    def test_complete_image_metadata_is_required(self):
        records = {image: {"image": image, "sha": SHA, "digest": digest}
                   for image, digest in DIGESTS.items()}
        for image in ("api", "worker"):
            for field, value in (("sha", NEW_SHA), ("digest", "bad"), ("image", "other")):
                invalid = copy.deepcopy(records)
                invalid[image][field] = value
                with self.subTest(image=image, field=field), self.assertRaises(ValueError):
                    build_marker(REPO, SHA, 200, 1, invalid)
        with self.assertRaises(KeyError):
            build_marker(REPO, SHA, 200, 1, {"api": records["api"]})


class PromotionTests(unittest.TestCase):
    def test_built_marker_must_come_from_correct_successful_build_attempt(self):
        valid = marker()
        self.assertEqual(validate_marker(valid, "built", REPO, run("Build Images", 200), SHA), valid)
        for source in (run("Build Images", 201), run("Build Images", 200, attempt=2),
                       run("CI", 200), run("Build Images", 200, conclusion="failure")):
            with self.subTest(source=source), self.assertRaises(ValueError):
                validate_marker(valid, "built", REPO, source, SHA)

    def test_wrong_commit_branch_repository_stage_and_digest_are_rejected(self):
        for key, value in (("sha", NEW_SHA), ("sha", "bad\nsha=evil"), ("branch", "feature"),
                           ("repository", "Other/Repo"), ("stage", "promoted"),
                           ("schemaVersion", 0), ("schemaVersion", True), ("images", {"api": DIGESTS["api"]})):
            invalid = {**marker(), key: value}
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_marker(invalid, "built", REPO, run("Build Images", 200), SHA)

    def test_deploy_requires_marker_from_successful_promotion_not_a_build(self):
        promoted = {**marker(), "stage": "promoted", "promotion": {"runId": 300, "attempt": 2}}
        self.assertEqual(validate_marker(promoted, "promoted", REPO,
                                         run("Push Images", 300, attempt=2), SHA), promoted)
        for invalid in (marker(), {**promoted, "promotion": {"runId": 300, "attempt": 1}}):
            with self.assertRaises(ValueError):
                validate_marker(invalid, "promoted", REPO, run("Push Images", 300, attempt=2), SHA)

    def test_manual_or_automatic_deploy_cannot_use_superseded_commit(self):
        with self.assertRaisesRegex(ValueError, "stale"):
            assert_current(SHA, NEW_SHA)

    def test_digests_are_inspected_before_promotion_and_all_tags_match_before_deploy(self):
        def inspect(command, **kwargs):
            image = "api" if "/api" in command[4] else "worker"
            return subprocess.CompletedProcess(command, 0, json.dumps({"digest": DIGESTS[image]}))

        with patch("release.subprocess.run", side_effect=inspect) as docker:
            verify_images(marker(), REPO, [])
            refs = [call.args[0][4] for call in docker.call_args_list]
            self.assertEqual(refs, [f"ghcr.io/{REPO.lower()}/{image}@{digest}"
                                    for image, digest in DIGESTS.items()])
            docker.reset_mock()
            verify_images(marker(), REPO, ["main", "latest"])
            self.assertEqual(docker.call_count, 4)

    def test_tag_drift_and_registry_failure_block_release(self):
        with patch("release.subprocess.run", return_value=subprocess.CompletedProcess(
                [], 0, json.dumps({"digest": "sha256:" + "f" * 64}))):
            with self.assertRaisesRegex(ValueError, "mismatch"):
                verify_images(marker(), REPO, ["latest"])
        with patch("release.subprocess.run", side_effect=subprocess.CalledProcessError(1, "docker")):
            with self.assertRaises(subprocess.CalledProcessError):
                verify_images(marker(), REPO, [])


class CliTests(unittest.TestCase):
    def test_build_promotion_deploy_handoff_uses_same_commit_and_both_digests(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            script = Path(__file__).with_name("release.py").resolve()
            (directory / "image-digests").mkdir()
            for image, digest in DIGESTS.items():
                (directory / f"image-digests/{image}.json").write_text(json.dumps(
                    {"image": image, "sha": SHA, "digest": digest}))
            env = {**os.environ, "GITHUB_REPOSITORY": REPO, "GITHUB_RUN_ID": "200",
                   "GITHUB_RUN_ATTEMPT": "1", "HEAD_SHA": SHA, "CURRENT_MAIN_SHA": SHA,
                   "GITHUB_EVENT_NAME": "workflow_run", "GITHUB_REF": "refs/heads/main",
                   "GITHUB_OUTPUT": str(directory / "outputs")}

            def invoke(command):
                result = subprocess.run([sys.executable, str(script), command], cwd=directory,
                                        env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)

            invoke("write-build")
            (directory / "source-run.json").write_text(json.dumps(run("Build Images", 200)))
            env["GITHUB_RUN_ID"] = "300"
            invoke("promote")
            promoted = json.loads((directory / "release/image-release.json").read_text())
            self.assertEqual(promoted["sha"], SHA)
            self.assertEqual(promoted["images"], DIGESTS)
            self.assertEqual(promoted["stage"], "promoted")
            (directory / "source-run.json").write_text(json.dumps(run("Push Images", 300)))
            invoke("deploy")
            self.assertIn(f"sha={SHA}\n", (directory / "outputs").read_text())

    def test_missing_artifact_is_error_not_successful_noop(self):
        with tempfile.TemporaryDirectory() as directory:
            script = Path(__file__).with_name("release.py").resolve()
            result = subprocess.run([sys.executable, str(script), "deploy"], cwd=directory,
                                    env={**os.environ, "GITHUB_REPOSITORY": REPO},
                                    capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Release blocked", result.stderr)

    def test_real_cli_emits_build_sha_for_successful_ci(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            event = directory / "event.json"
            event.write_text(json.dumps({"workflow_run": run()}))
            outputs = directory / "outputs"
            result = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("release.py").resolve()), "select-build"],
                cwd=directory, capture_output=True, text=True, env={**os.environ,
                    "GITHUB_REPOSITORY": REPO, "GITHUB_EVENT_NAME": "workflow_run",
                    "GITHUB_EVENT_PATH": str(event), "GITHUB_REF": "refs/heads/main",
                    "GITHUB_SHA": SHA, "CURRENT_MAIN_SHA": SHA, "GITHUB_OUTPUT": str(outputs)},
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(f"sha={SHA}\n", outputs.read_text())


if __name__ == "__main__":
    unittest.main()
