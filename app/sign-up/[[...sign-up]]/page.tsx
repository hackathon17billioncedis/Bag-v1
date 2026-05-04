import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return (
    <main className="app-shell admin-shell">
      <div className="container">
        <section className="panel image-panel" style={{ minHeight: '70vh' }}>
          <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
        </section>
      </div>
    </main>
  )
}
