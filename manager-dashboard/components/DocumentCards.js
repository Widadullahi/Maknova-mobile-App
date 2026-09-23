'use client';

import { canPreviewDocument, propertyDocumentUrl, verificationDocumentUrl } from '../lib/api';
import { formatCount, labelize } from '../lib/format';
import styles from './dashboard.module.css';

export function DocumentCards({ documents = [], token, kind = 'verification', emptyText = 'No uploaded documents are attached to this response.' }) {
  const buildUrl = kind === 'property' ? propertyDocumentUrl : verificationDocumentUrl;

  return (
    <div className={styles.documentList}>
      <strong>Uploaded documents</strong>
      {documents.length ? documents.map((doc) => {
        const url = buildUrl(doc, token);
        const downloadUrl = buildUrl(doc, token, true);
        return (
          <div key={doc.id || doc.category || doc.fileUrl || doc.fileName} className={styles.documentCard}>
            <div className={styles.documentInfo}>
              <span>{labelize(doc.category || doc.type, 'Document')}</span>
              <strong>{doc.fileName || 'Uploaded document'}</strong>
              <small>{doc.mimeType || 'Unknown file type'}{doc.fileSize ? ` / ${formatCount(doc.fileSize)} bytes` : ''}</small>
            </div>
            {url && canPreviewDocument(doc) ? (
              <a className={styles.previewFrame} href={url} target="_blank" rel="noreferrer">
                {String(doc.mimeType || '').startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={doc.fileName || 'Document preview'} src={url} />
                ) : (
                  <iframe src={url} title={doc.fileName || 'Document preview'} />
                )}
              </a>
            ) : null}
            <div className={styles.documentActions}>
              {url ? <a href={url} target="_blank" rel="noreferrer">Preview</a> : <small>No file URL</small>}
              {url ? <a download={doc.fileName || true} href={downloadUrl}>Download</a> : null}
            </div>
          </div>
        );
      }) : <p>{emptyText}</p>}
    </div>
  );
}
