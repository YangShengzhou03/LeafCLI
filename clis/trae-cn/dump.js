import { makeDumpCommand } from '../_shared/desktop-commands.js';

export const dumpCommand = makeDumpCommand('trae-cn', {
  example: 'leafcli_CDP_ENDPOINT=http://127.0.0.1:39240 leafcli_CDP_TARGET=talk leafcli trae-cn dump -f json',
});
