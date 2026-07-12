import { cli, Strategy } from '@yangshengzhou/leafcli/registry';
import { EmptyResultError } from '@yangshengzhou/leafcli/errors';
import { NOTEBOOKLM_DOMAIN, NOTEBOOKLM_SITE } from './shared.js';
import { getNotebooklmPageState, listNotebooklmHistoryViaRpc, requireNotebooklmSession, } from './utils.js';
cli({
    site: NOTEBOOKLM_SITE,
    name: 'history',
    access: 'read',
    description: 'List NotebookLM conversation history threads in the current notebook',
    domain: NOTEBOOKLM_DOMAIN,
    strategy: Strategy.COOKIE,
    browser: true,
    navigateBefore: false,
    args: [],
    columns: ['thread_id', 'item_count', 'preview', 'source', 'notebook_id', 'url'],
    func: async (page) => {
        await requireNotebooklmSession(page);
        const state = await getNotebooklmPageState(page);
        if (state.kind !== 'notebook') {
            throw new EmptyResultError('leafcli notebooklm history', 'No NotebookLM notebook is open in the adapter session. Run `leafcli notebooklm open <notebook>` first.');
        }
        const rows = await listNotebooklmHistoryViaRpc(page);
        return rows;
    },
});
