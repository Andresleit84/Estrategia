import Link from "next/link";

export const metadata = {
  title: "Política de privacidad — Estrategia",
  description: "Cómo recopilamos, usamos y protegemos tu información en la plataforma Estrategia OKR.",
};

export default function PrivacyPage() {
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

        <h1 className="text-3xl font-bold text-white mb-2">Política de privacidad</h1>
        <p className="text-white/40 text-sm mb-10">
          Última actualización: {new Date().toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <div className="space-y-8 text-white/70 text-[15px] leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Quiénes somos</h2>
            <p>
              SendoÁgil (&ldquo;nosotros&rdquo;) opera la plataforma Estrategia OKR. Esta política explica cómo
              recopilamos, usamos, almacenamos y protegemos tu información personal cuando usás el Servicio.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Información que recopilamos</h2>

            <h3 className="text-base font-medium text-white/90 mb-2 mt-4">Información que nos proporcionás:</h3>
            <ul className="space-y-2 pl-4">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Datos de cuenta: nombre, email, contraseña (almacenada con hash bcrypt).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Datos de organización: nombre, slug, plan contratado.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Contenido de uso: objetivos, resultados clave, check-ins, iniciativas y comentarios.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Datos de pago: procesados directamente por Stripe o MercadoPago; no almacenamos números de tarjeta.</span>
              </li>
            </ul>

            <h3 className="text-base font-medium text-white/90 mb-2 mt-4">Información que recopilamos automáticamente:</h3>
            <ul className="space-y-2 pl-4">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Logs de acceso: IP, user-agent, timestamps de autenticación.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Eventos de error: capturados vía Sentry para diagnóstico (sin datos sensibles).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Cookies de sesión: HttpOnly, para mantener tu sesión autenticada.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Cómo usamos tu información</h2>
            <ul className="space-y-2 pl-4">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Proveer y mantener el Servicio.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Procesar pagos y emitir facturas.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Enviarte notificaciones transaccionales (check-ins, alertas de progreso).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Mejorar el Servicio mediante análisis de uso agregado y anonimizado.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Cumplir obligaciones legales.</span>
              </li>
            </ul>
            <p className="mt-3">
              <strong className="text-white/90">No vendemos ni alquilamos</strong> tus datos a terceros con fines
              comerciales.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Cookies</h2>
            <p className="mb-3">Usamos las siguientes cookies:</p>
            <div className="space-y-3">
              <div
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="text-white/90 font-medium text-sm mb-1">session (HttpOnly, Secure)</p>
                <p className="text-xs">Token JWT de sesión. Esencial para el funcionamiento del Servicio. Expira en 15 minutos; se renueva automáticamente.</p>
              </div>
              <div
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="text-white/90 font-medium text-sm mb-1">refresh_token (HttpOnly, Secure)</p>
                <p className="text-xs">Token de renovación de sesión. Expira en 7 días (30 si elegiste &ldquo;recordarme&rdquo;).</p>
              </div>
              <div
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="text-white/90 font-medium text-sm mb-1">NEXT_LOCALE</p>
                <p className="text-xs">Preferencia de idioma de la interfaz (es/en). No tiene información personal.</p>
              </div>
            </div>
            <p className="mt-3 text-sm">
              No usamos cookies de publicidad ni de rastreo de terceros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Proveedores de servicios (subprocesadores)</h2>
            <p className="mb-3">Compartimos datos con los siguientes proveedores exclusivamente para operar el Servicio:</p>
            <div className="space-y-2">
              {[
                { name: "Stripe", purpose: "Procesamiento de pagos internacionales", country: "EE.UU." },
                { name: "MercadoPago", purpose: "Procesamiento de pagos en Argentina", country: "Argentina" },
                { name: "Sentry", purpose: "Monitoreo de errores (datos anonimizados)", country: "EE.UU." },
              ].map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div>
                    <span className="text-white/90 font-medium text-sm">{p.name}</span>
                    <span className="text-white/40 text-xs ml-2">— {p.purpose}</span>
                  </div>
                  <span className="text-xs text-white/30">{p.country}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Seguridad</h2>
            <p className="mb-3">Implementamos medidas técnicas y organizativas para proteger tus datos:</p>
            <ul className="space-y-2 pl-4">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Cifrado en tránsito: TLS 1.3 en todas las comunicaciones.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Contraseñas almacenadas con bcrypt (factor 12).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Aislamiento por organización: Row-Level Security en PostgreSQL.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>Backups diarios cifrados con retención de 30 días.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Retención de datos</h2>
            <p>
              Tus datos se conservan mientras tu cuenta esté activa. Al cancelar, los datos se retienen 90 días
              para exportación y luego se eliminan permanentemente. Los datos de facturación se conservan 10 años
              por obligaciones fiscales.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Tus derechos</h2>
            <p className="mb-3">
              Tenés derecho a:
            </p>
            <ul className="space-y-2 pl-4">
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span><strong className="text-white/90">Acceder</strong> a los datos que tenemos sobre vos.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span><strong className="text-white/90">Exportar</strong> tus datos en formato JSON o CSV desde Configuración.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span><strong className="text-white/90">Rectificar</strong> datos incorrectos desde tu perfil.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span><strong className="text-white/90">Eliminar</strong> tu cuenta y todos tus datos (sujeto a retención fiscal).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span><strong className="text-white/90">Oponerte</strong> al procesamiento de tus datos para fines que no sean esenciales.</span>
              </li>
            </ul>
            <p className="mt-3">
              Para ejercer estos derechos escribinos a{" "}
              <a href="mailto:andres.enrique@sendoagil.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                andres.enrique@sendoagil.com
              </a>
              . Respondemos en un máximo de 30 días.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Menores de edad</h2>
            <p>
              El Servicio está dirigido a empresas y profesionales. No recopilamos intencionalmente datos de
              personas menores de 18 años. Si tomás conocimiento de que un menor ha creado una cuenta, contactanos
              para eliminarla.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Cambios en esta política</h2>
            <p>
              Podemos actualizar esta política ocasionalmente. Notificaremos cambios significativos por email con
              al menos 15 días de anticipación. El uso continuado del Servicio luego del aviso implica aceptación
              de la nueva política.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Contacto</h2>
            <p>
              Para consultas sobre privacidad o para ejercer tus derechos, escribinos a{" "}
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
