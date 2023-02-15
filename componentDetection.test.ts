import ComponentDetection from './componentDetection';
import fs from 'fs';

test('Downloads CLI', async () => {
  await ComponentDetection.downloadLatestRelease();
  expect(fs.existsSync(ComponentDetection.componentDetectionPath));
});

test('Runs CLI', async () => {
  await ComponentDetection.downloadLatestRelease();
  await ComponentDetection.runComponentDetection('./test');
  expect(fs.existsSync(ComponentDetection.outputPath));
});

test('Parses CLI output', async () => {
  await ComponentDetection.downloadLatestRelease();
  await ComponentDetection.runComponentDetection('./test');
  var manifests = await ComponentDetection.getManifestsFromResults();
  expect(manifests?.length == 2);
});