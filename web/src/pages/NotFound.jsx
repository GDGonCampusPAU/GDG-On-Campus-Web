import Button from '../components/Button.jsx'

export default function NotFound() {
  return (
    <section className="container" style={{ padding: '96px 0', textAlign: 'center' }}>
      <h1>Sayfa bulunamadı</h1>
      <p style={{ margin: '16px 0 32px' }}>Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.</p>
      <Button to="/">Ana sayfaya dön</Button>
    </section>
  )
}
