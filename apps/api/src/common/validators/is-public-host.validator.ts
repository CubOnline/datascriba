import { registerDecorator, ValidationOptions } from 'class-validator'

/**
 * RFC-1918 / link-local / loopback bloklayan regex.
 * SSRF saldırılarında kullanılan iç ağ adreslerini reddeder.
 * Engellenen aralıklar:
 *   - 127.x.x.x        (loopback)
 *   - 10.x.x.x         (RFC-1918 Class A)
 *   - 172.16-31.x.x    (RFC-1918 Class B)
 *   - 192.168.x.x      (RFC-1918 Class C)
 *   - 169.254.x.x      (link-local / APIPA)
 *   - ::1              (IPv6 loopback)
 *   - fc00::/7         (IPv6 unique local — fc/fd prefix)
 *   - "localhost" hostname
 *
 * Not: DNS rebinding koruması için production ortamında outbound proxy önerilir.
 */
const BLOCKED_HOST_RE =
  /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1$|fc[0-9a-f][0-9a-f]:|fd[0-9a-f][0-9a-f]:)/i

/**
 * SSRF saldırılarına karşı iç ağ/loopback adreslerini bloklayan dekoratör.
 * DataSource host alanlarında kullanılır.
 */
export function IsPublicHost(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isPublicHost',
      target: (object as { constructor: Function }).constructor,
      propertyName,
      options: {
        message: 'Private, loopback, and link-local addresses are not allowed',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false
          return !BLOCKED_HOST_RE.test(value)
        },
      },
    })
  }
}
