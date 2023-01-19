import conda from './condaParser';

test('Gets files', async () => {
  var files = conda.searchFiles("test", "environment.yaml");
  expect(files.length).toEqual(1);
});

test('Parses manifests', async() => {
  var files = conda.searchFiles("test", "environment.yaml");
  var manifests = conda.getManifestsFromEnvironmentFiles(files);
  expect(manifests.length).toEqual(1);
})