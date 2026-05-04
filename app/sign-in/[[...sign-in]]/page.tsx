import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <main className="app-shell admin-shell">
      <div className="container">
        <section className="panel image-panel" style={{ minHeight: '70vh' }}>
          <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
        </section>
      </div>
    </main>
  )
}
