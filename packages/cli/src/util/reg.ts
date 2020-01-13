export function escapeReg (text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
