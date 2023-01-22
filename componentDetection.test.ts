import ComponentDetection from './componentDetection';
import fs from 'fs';

test('Downloads CLI', async () => {
  ComponentDetection.downloadLatestRelease();
  expect(fs.existsSync(ComponentDetection.componentDetectionPath));
});

test('Runs CLI', async () => {
   await ComponentDetection.runComponentDetection('./test');
   expect(fs.existsSync(ComponentDetection.outputPath));
});

test('Parses CLI output', async () => {
  var manifests = await ComponentDetection.getManifestsFromResults();
  expect(manifests?.length == 2);
});