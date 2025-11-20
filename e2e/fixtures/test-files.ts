import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const TEST_FILES = {
  DOC_01_MD: path.resolve(__dirname, './files/test-doc-01.md'),
  DOC_02_TXT: path.resolve(__dirname, './files/test-doc-02.txt'),
  DOC_03_MD: path.resolve(__dirname, './files/test-doc-03.md'),
  INVALID_PDF: path.resolve(__dirname, './files/test-invalid.pdf'),
};

export const FILE_NAMES = {
  DOC_01_MD: 'test-doc-01.md',
  DOC_02_TXT: 'test-doc-02.txt',
  DOC_03_MD: 'test-doc-03.md',
  INVALID_PDF: 'test-invalid.pdf',
};
