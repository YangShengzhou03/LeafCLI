import { cli, Strategy } from '@yangshengzhou/leafcli/registry';
import { inspectTraeShellScript } from './utils.js';

export const modelCommand = cli({
  site: 'trae-cn',
  name: 'model',
  access: 'read',
  description: 'Read the model label currently shown in the Trae CN chat input',
  example: 'leafcli_CDP_ENDPOINT=http://127.0.0.1:39240 leafcli_CDP_TARGET=talk leafcli trae-cn model -f json',
  domain: 'localhost',
  strategy: Strategy.UI,
  browser: true,
  columns: ['Model', 'Agent', 'Workspace'],
  func: async (page) => {
    const info = await page.evaluate(inspectTraeShellScript());
    return [{
      Model: info.model || '',
      Agent: info.agent || '',
      Workspace: info.workspace || '',
    }];
  },
});
