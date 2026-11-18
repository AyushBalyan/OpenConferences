/**
 * Open a link that has to be fetched first (a signed file URL) in a new tab.
 * The tab is opened during the click so pop-up blockers allow it, then pointed
 * at the URL once it is known. Rejects if the URL cannot be fetched or shown.
 */
export async function openInNewTab(resolveUrl: () => Promise<string>) {
  const tab = window.open('', '_blank');
  try {
    const url = await resolveUrl();
    if (!tab) throw new Error('Could not open a new tab. Allow pop-ups for this site.');
    tab.opener = null;
    tab.location.href = url;
  } catch (error) {
    tab?.close();
    throw error;
  }
}
