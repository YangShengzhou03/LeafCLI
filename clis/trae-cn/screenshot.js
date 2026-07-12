import { makeScreenshotCommand } from '../_shared/desktop-commands.js';

export const screenshotTraeCn = makeScreenshotCommand('trae-cn', 'Trae CN', {
  example: 'leafcli_CDP_ENDPOINT=http://127.0.0.1:39240 leafcli_CDP_TARGET=talk leafcli trae-cn screenshot --output /tmp/trae-cn-snapshot.txt',
});
