import { TemplateService } from './template.service';

const readFileMock = jest.fn();

jest.mock('fs', () => ({
  promises: {
    readFile: (...args: any[]) => readFileMock(...args),
  },
}));

describe('TemplateService', () => {
  let service: TemplateService;

  beforeEach(() => {
    readFileMock.mockReset();
    service = new TemplateService();
  });

  it('loads template from disk and caches it', async () => {
    readFileMock.mockResolvedValueOnce('<html>');

    await expect(service.loadTemplate('file.html')).resolves.toBe('<html>');
    await expect(service.loadTemplate('file.html')).resolves.toBe('<html>');

    expect(readFileMock).toHaveBeenCalledTimes(1);
    expect(readFileMock.mock.calls[0][0]).toContain('templates');
    expect(readFileMock.mock.calls[0][0]).toContain('file.html');
  });

  it('renders template replacing placeholders', () => {
    const template = 'Hello %%NAME%%, value %%VALUE%%, missing %%NONE%%';
    const result = service.render(template, { NAME: 'John', VALUE: 42, NONE: null });
    expect(result).toBe('Hello John, value 42, missing ');
  });
});

