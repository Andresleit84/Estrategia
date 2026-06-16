import Link from "next/link";

export const metadata = {
  title: "Términos de servicio — Estrategia",
  description: "Términos y condiciones de uso de la plataforma Estrategia OKR.",
};

export default function TermsPage() {
  return (
    <div
      className="min-h-screen py-16 px-4"
      style={{ background: "linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 50%, #0a0a1a 100%)" }}
    >
      <div className="max-w-3xl mx-auto">
        {/* Back */}
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-10"
        >
          ← Volver a precios
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Términos de servicio</h1>
        <p className="text-white/40 text-sm mb-10">
          Última actualización: {new Date().toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <div className="space-y-8 text-white/70 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Aceptación de los términos</h2>
            <p>
              Al acceder o utilizar la plataforma Estrategia (&ldquo;el Servicio&rdquo;), operada por SendoÁgil
              (&ldquo;nosotros&rdquo;, &ldquo;nos&rdquo;), aceptás estos Términos de Servicio en su totalidad.
              Si no estás de acuerdo con alguna parte de estos términos, no podés usar el Servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Descripción del servicio</h2>
            <p>
              Estrategia es una plataforma de gestión de OKRs (Objectives and Key Results) que permite a empresas
              y equipos definir, hacer seguimiento y alinear sus objetivos estratégicos y tácticos. El Servicio
              incluye herramientas de planificación, check-ins periódicos, reportes y asistentes de inteligencia
              artificial.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Registro y responsabilidades de la cuenta</h2>
            <p className="mb-3">
              Para usar el Servicio debés crear una cuenta con información veraz y completa. Sos responsable de:
            </p>
            <ul className="space-y-2 pl-4">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Mantener la confidencialidad de tu contraseña.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Todas las actividades que ocurran bajo tu cuenta.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Notificarnos de inmediato si sospechás un acceso no autorizado.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Planes y pagos</h2>
            <p className="mb-3">
              El Servicio se ofrece en distintos planes (Free, Pro, Enterprise). Los pagos se procesan mediante
              Stripe (pagos internacionales) o MercadoPago (Argentina). Al suscribirte a un plan de pago:
            </p>
            <ul className="space-y-2 pl-4">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Autorizás el cobro periódico según el ciclo de facturación elegido.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Podés cancelar en cualquier momento; el acceso continúa hasta el fin del período ya pagado.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>No realizamos reembolsos por períodos parciales, salvo error de nuestra parte.</span>
              </li>
            </ul>
            <p className="mt-3">
              Los precios pueden cambiar con 30 días de aviso previo por email. Los planes anuales bloquean el
              precio por el período contratado.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Propiedad intelectual</h2>
            <p className="mb-3">
              El Servicio y todos sus componentes (código, diseño, marca, documentación) son propiedad de
              SendoÁgil o sus licenciantes. Te otorgamos una licencia limitada, no exclusiva y no transferible
              para usar el Servicio según estos términos.
            </p>
            <p>
              Vos conservás todos los derechos sobre los datos que ingresás en el Servicio (objetivos, métricas,
              información de tu organización). Nos otorgás una licencia para procesar esos datos con el único fin
              de prestarte el Servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Uso aceptable</h2>
            <p className="mb-3">No podés:</p>
            <ul className="space-y-2 pl-4">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Usar el Servicio para actividades ilegales o fraudulentas.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Intentar acceder a datos de otras organizaciones.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Realizar ingeniería inversa, descompilar o copiar el Servicio.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Revender o sublicenciar el acceso a terceros sin autorización escrita.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Limitación de responsabilidad</h2>
            <p className="mb-3">
              El Servicio se provee &ldquo;tal como está&rdquo; y &ldquo;según disponibilidad&rdquo;. En la medida
              permitida por la ley, SendoÁgil no será responsable por:
            </p>
            <ul className="space-y-2 pl-4">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Pérdida de datos o interrupciones del servicio.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Daños indirectos, incidentales o consecuentes.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Decisiones de negocio tomadas basándose en el Servicio.</span>
              </li>
            </ul>
            <p className="mt-3">
              Nuestra responsabilidad total no excederá el monto que pagaste en los últimos 3 meses.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Privacidad</h2>
            <p>
              El tratamiento de tus datos personales se rige por nuestra{" "}
              <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                Política de Privacidad
              </Link>
              , que forma parte de estos Términos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Terminación</h2>
            <p>
              Podemos suspender o cancelar tu cuenta si incumplís estos Términos, previo aviso cuando sea posible.
              Al cancelar, tus datos se retienen por 90 días para permitirte exportarlos, luego son eliminados de
              forma permanente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Ley aplicable y jurisdicción</h2>
            <p>
              Estos Términos se rigen por las leyes de la República Argentina. Cualquier disputa se someterá a los
              tribunales ordinarios de la Ciudad Autónoma de Buenos Aires.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Contacto</h2>
            <p>
              Para consultas sobre estos Términos, escribinos a{" "}
              <a
                href="mailto:andres.enrique@sendoagil.com"
                className="text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                andres.enrique@sendoagil.com
              </a>
              .
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <span className="text-white/30 text-xs">© {new Date().getFullYear()} SendoÁgil. Todos los derechos reservados.</span>
          <div className="flex gap-4 text-xs text-white/30">
            <Link href="/terms" className="hover:text-white/60 transition-colors">Términos</Link>
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacidad</Link>
            <Link href="/pricing" className="hover:text-white/60 transition-colors">Precios</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
