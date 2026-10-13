import Head from 'next/head'
import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/600.css'
import '@fontsource/pixelify-sans/700.css'
import '../styles/globals.css'
import SceneBackdrop from '../components/SceneBackdrop'
import { useTheme } from '../lib/theme'

export default function App({ Component, pageProps }) {
  const theme = useTheme()
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* phone browser-bar colour follows the in-app light/dark toggle */}
        <meta name="theme-color" content={theme === 'dark' ? '#1b1510' : '#f0eee3'} key="theme-color" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <title>Daily Brief</title>
      </Head>
      <SceneBackdrop />
      <Component {...pageProps} />
    </>
  )
}
