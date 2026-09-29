import '../styles/globals.css'
import PixelBackdrop from '../components/PixelBackdrop'

export default function App({ Component, pageProps }) {
  return (
    <>
      <PixelBackdrop />
      <Component {...pageProps} />
    </>
  )
}
