import {downloadLatestRelease, getManifestsFromResults, runComponentDetection} from './componentDetection';

test('Downloads CLI', async () => {
  downloadLatestRelease();
});

test('Runs CLI', async () => {
   runComponentDetection('./test');
});

test('Parses CLI output', async () => {
  getManifestsFromResults();
});