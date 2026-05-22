// ─── Vertex Shader : Forme Fractale ─────────────────────────────────────────
// FBM noise simplex 3D, déplacement radial le long de la normale.
// Expose v_worldPos pour le calcul du reflet HDR (frag) et v_normalW pour reflect().

// ── Simplex 3D Noise (Ian McEwan / Ashima Arts — MIT) ────────────────────────
vec3 _mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 _mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 _permute(vec4 x) { return _mod289(((x * 34.0) + 1.0) * x); }
vec4 _taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = _mod289(i);
  vec4 p = _permute(_permute(_permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
    i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
    i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = _taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

uniform float u_time;
uniform float u_noiseStrength;
uniform float u_noiseFrequency;

attribute float a_oxidation;

varying vec3  v_worldPos;
varying vec3  v_normal;     // view-space (legacy, conservé pour rim light)
varying vec3  v_normalW;    // world-space (pour reflect en frag)
varying float v_noiseVal;
varying float v_oxidation;

void main() {
  vec3 p = position * u_noiseFrequency;

  float noise = 0.0;
  noise += 0.600 * snoise(p       + u_time * 0.12);
  noise += 0.300 * snoise(p * 2.1 + u_time * 0.18 + vec3(1.7, 9.2, 3.4));
  noise += 0.075 * snoise(p * 4.3 + u_time * 0.27 + vec3(8.3, 2.8, 5.1));
  noise += 0.025 * snoise(p * 8.6 + u_time * 0.40 + vec3(4.2, 6.5, 1.9));

  vec3 displaced = position + normal * noise * u_noiseStrength;

  v_noiseVal  = noise;
  v_oxidation = a_oxidation;
  v_worldPos  = (modelMatrix * vec4(displaced, 1.0)).xyz;
  v_normal    = normalize(normalMatrix * normal);
  // Normale en world-space : nécessaire pour reflect(viewDir, normalW) cohérent avec u_envMap
  v_normalW   = normalize(mat3(modelMatrix) * normal);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
