import { omit } from 'lodash';
import { oncePerServer } from '../../../server/lib/once_per_server';
import { generatePdfFactory } from './lib/generate_pdf';
import { cryptoFactory } from './lib/crypto';

const KBN_SCREENSHOT_HEADER_BLACKLIST = [
  'accept-encoding',
  'content-length',
  'content-type',
  'host',
];

function executeJobFn(server) {
  const generatePdf = generatePdfFactory(server);
  const crypto = cryptoFactory(server);

  return async function executeJob(job) {
    const { title, objects, query, headers:serializedEncryptedHeaders } = job;
    let decryptedHeaders;

    try {
      decryptedHeaders = await crypto.decrypt(serializedEncryptedHeaders);
    } catch (e) {
      throw new Error('Failed to decrypt report job data. Please re-generate this report.');
    }

    const headers = omit(decryptedHeaders, KBN_SCREENSHOT_HEADER_BLACKLIST);
    const pdf = await generatePdf(title, objects, query, headers);
    const buffer = await pdf.getBuffer();

    return {
      content_type: 'application/pdf',
      content: buffer.toString('base64')
    };
  };
}

export const executeJobFactory = oncePerServer(executeJobFn);
