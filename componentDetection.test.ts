import {downloadLatestRelease, runComponentDetection} from './componentDetection';

test('Downloads CLI', async () => {
  downloadLatestRelease();
});

test('Runs CLI', async () => {
   runComponentDetection('./test');
});