// esbuild inlines .pem files as strings (--loader:.pem=text)
declare module '*.pem' {
  const content: string;
  export default content;
}
