declare module 'pdfjs-dist/legacy/build/pdf.js' {
  const pdfjs: typeof import('pdfjs-dist');
  export = pdfjs;
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.js' {
  export const WorkerMessageHandler: unknown;
}

declare module '@ungap/structured-clone' {
  const structuredClonePolyfill: (value: unknown, options?: unknown) => unknown;
  export default structuredClonePolyfill;
}