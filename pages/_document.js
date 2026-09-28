import { Html, Head, Main, NextScript } from 'next/document'

// Apply the saved (or system) theme before first paint to avoid a flash
const THEME_INIT = `(function(){try{var t=localStorage.getItem('db-theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
