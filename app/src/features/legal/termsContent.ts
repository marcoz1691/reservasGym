/**
 * Términos y condiciones de Zona Cero que el socio acepta antes de pagar.
 *
 * PENDIENTE: el texto lo entrega Zona Cero. Para publicarlo, pega cada
 * párrafo en `paragraphs` y pon la fecha de vigencia en `updatedAt`
 * (AAAA-MM-DD). Mientras esté vacío, la ventana avisa que el documento está
 * en preparación.
 */
export const TERMS = {
  title: 'Términos y condiciones',
  updatedAt: null as string | null,
  paragraphs: [] as string[],
}

export const termsArePublished = () => TERMS.paragraphs.length > 0
