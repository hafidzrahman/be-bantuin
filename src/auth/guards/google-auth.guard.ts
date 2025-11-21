import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();

    // 1. Deteksi Host secara Dinamis (Localhost vs Ngrok)
    // 'x-forwarded-proto' biasanya diset oleh Ngrok/Proxy (http vs https)
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host; // Ini akan berisi 'localhost:5500' atau 'xxxx.ngrok-free.dev'

    const dynamicCallbackURL = `${protocol}://${host}/api/auth/google/callback`;

    // 2. Deteksi Frontend URL (Asal User)
    // Kita ambil dari query param ?returnUrl=... atau fallback ke Referer header
    let returnUrl = req.query.returnUrl || req.headers.referer;

    // Bersihkan trailing slash jika ada (misal: http://localhost:3000/ -> http://localhost:3000)
    if (returnUrl) {
      try {
        const urlObj = new URL(returnUrl);
        returnUrl = urlObj.origin; // Ambil origin saja (http://localhost:3000)
      } catch (e) {
        // Ignore error if invalid URL
      }
    }

    // 3. Simpan URL Frontend di dalam 'state' OAuth (Base64 encoded)
    // Google akan mengembalikan 'state' ini ke kita setelah login sukses
    const state = returnUrl
      ? Buffer.from(JSON.stringify({ returnUrl })).toString('base64')
      : undefined;

    return {
      callbackURL: dynamicCallbackURL,
      state: state,
    };
  }
}
