// ─── Word fragment ──────────────────────────────────────────────────────────
// Sample la texture canvas du mot, atténue par uOpacity (fade sin^2.5 piloté
// en JS), discard sous l'eau via v_worldY.

uniform sampler2D uMap;
uniform float     uOpacity;
uniform float     u_waterY;

varying vec2  vUv;
varying float v_worldY;

void main() {
  if (v_worldY < u_waterY) discard;

  vec4 tex = texture2D(uMap, vUv);
  // AdditiveBlending : on multiplie rgb par opacité, alpha reste 1 (ignoré).
  vec3 rgb = tex.rgb * tex.a * uOpacity;
  if (max(max(rgb.r, rgb.g), rgb.b) < 0.002) discard;
  gl_FragColor = vec4(rgb, tex.a * uOpacity);
}
