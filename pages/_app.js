import Head from 'next/head'
import '../styles/globals.css'
import PixelBackdrop from '../components/PixelBackdrop'
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
      <PixelBackdrop />
      <Component {...pageProps} />
    </>
  )
}
