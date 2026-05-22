// ─── Fragment Shader : Oxydation Cuivre → Vert-de-gris + Reflet HDR ─────────

#define MAX_HITS 8
#define HIT_Z_SCALE 0.22

uniform float u_time;
uniform vec3  u_hitPoints[MAX_HITS];
uniform float u_hitTimes[MAX_HITS];
uniform float u_hitRadius;

// ── Reflet HDR ──────────────────────────────────────────────────────────────
// Deux HDR équirectangulaires (presets drei) : "dawn" pour le jour, "night"
// pour la nuit, mixés par u_progress (0=jour, 1=nuit). Échantillonnage brut
// (pas de PMREM) → reflet net cohérent avec l'esthétique "métal qui se révèle".
uniform sampler2D u_envMapDay;
uniform sampler2D u_envMapNight;
uniform float     u_envIntensity;   // Gain global appliqué au reflet
uniform float     u_progress;       // 0=jour, 1=nuit — interpolation HDR

varying vec3  v_worldPos;
varying vec3  v_normal;
varying vec3  v_normalW;
varying float v_noiseVal;
varying float v_oxidation;

// ── Palette cuivre ─────────────────────────────────────────────────────────
const vec3 C_SHADOW   = vec3(0.10, 0.04, 0.01);
const vec3 C_BASE     = vec3(0.26, 0.11, 0.04);
const vec3 C_BRIGHT   = vec3(0.52, 0.23, 0.07);

// ── Palette oxydation ──────────────────────────────────────────────────────
const vec3 C_PATINA   = vec3(0.20, 0.66, 0.56);
const vec3 C_CORE     = vec3(0.04, 0.88, 0.84);
const vec3 C_ELECTRIC = vec3(0.08, 0.72, 1.00);
const vec3 C_RIM      = vec3(1.0, 1.0, 1.0);

const float PI = 3.14159265359;

// Mapping directionnel → UV équirectangulaire (atan/asin).
vec2 dirToEquirect(vec3 d) {
  return vec2(
    atan(d.z, d.x) * (0.5 / PI) + 0.5,
    asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5
  );
}

void main() {
  // ── 1. Couleur cuivre de base ──────────────────────────────────────────────
  float t      = clamp(v_noiseVal * 0.5 + 0.5, 0.0, 1.0);
  vec3  copper = mix(C_SHADOW, C_BRIGHT, t * t);

  // ── 2. Éclairage principal ────────────────────────────────────────────────
  vec3  lightDir = normalize(vec3(0.8, 1.2, 0.6));
  float diffuse  = max(dot(v_normal, lightDir), 0.0);
  float fresnel  = pow(1.0 - abs(dot(v_normal, vec3(0.0, 0.0, 1.0))), 3.5);

  const float AMBIENT = 0.65;
  const float DIFFUSE = 0.95;

  vec3 color = copper * (AMBIENT + DIFFUSE * diffuse);
  color += C_BASE * fresnel * 0.20;

  // ── 3. Contre-jour blanc (rim light) ──────────────────────────────────────
  float rimMask = pow(fresnel, 1.8);
  float rimFade = 1.0 - smoothstep(0.0, 0.55, diffuse);
  const float RIM_INTENSITY = 1.4;
  color += C_RIM * rimMask * rimFade * RIM_INTENSITY;

  // ── 4. Accumulation d'oxydation (ring buffer) ─────────────────────────────
  float oxidation = 0.0;
  float hotspot   = 0.0;

  for (int i = 0; i < MAX_HITS; i++) {
    float age = u_time - u_hitTimes[i];
    if (age > 8.0) continue;
    float ageFactor = exp(-1.2 * age);
    if (ageFactor < 0.004) continue;

    vec3  delta = v_worldPos - u_hitPoints[i];
    float dist  = length(vec3(delta.xy, delta.z * HIT_Z_SCALE));
    float proximity = 1.0 - smoothstep(0.0, u_hitRadius, dist);
    float core      = 1.0 - smoothstep(0.0, u_hitRadius * 1.0, dist);

    oxidation += proximity * ageFactor;
    hotspot   += core      * ageFactor;
  }

  oxidation = clamp(oxidation, 0.0, 1.0);
  hotspot   = clamp(hotspot,   0.0, 1.0);

  // ── 5. Transition cuivre → patine ─────────────────────────────────────────
  float persistent = clamp(v_oxidation, 0.0, 1.0);

  vec3 patinaLit = C_PATINA * (AMBIENT + DIFFUSE * diffuse);
  patinaLit += C_PATINA * fresnel * 0.25;
  vec3 patina = mix(patinaLit, C_CORE, hotspot);
  color = mix(color, patina, smoothstep(0.0, 1.0, persistent * 1.15));

  // ── 6. Halo électrique au cœur de l'impact ────────────────────────────────
  color += C_ELECTRIC * pow(max(hotspot, 0.0), 2.2) * 0.9;

  // ── 7. Specular cuivre (atténué par patine) ───────────────────────────────
  vec3  viewDir = normalize(vec3(0.0, 0.0, 1.0));
  vec3  halfVec = normalize(lightDir + viewDir);
  float spec    = pow(max(dot(v_normal, halfVec), 0.001), 40.0);
  color += vec3(0.9, 0.55, 0.25) * spec * (1.0 - persistent) * 0.25;

  // ── 8. Reflet HDR modulé par l'oxydation ─────────────────────────────────
  // Décapé (persistent=0) → métal réfléchissant, patiné (persistent=1) → mat.
  // Le reflet est calculé en world-space avec u_envMap échantillonné en équirect.
  vec3 V        = normalize(cameraPosition - v_worldPos);
  vec3 R        = reflect(-V, normalize(v_normalW));
  vec2 envUV    = dirToEquirect(normalize(R));
  vec3 envDay   = texture2D(u_envMapDay,   envUV).rgb;
  vec3 envNight = texture2D(u_envMapNight, envUV).rgb;
  vec3 envSample = mix(envDay, envNight, clamp(u_progress, 0.0, 1.0));

  // Fresnel world-space pour booster le reflet aux silhouettes (effet physique)
  float fresnelW = pow(1.0 - max(dot(V, normalize(v_normalW)), 0.0), 3.0);
  float reflectivity = mix(0.85, 0.05, persistent);
  // Mix additif modulé : on PRÉSERVE l'oxydation existante là où elle existe,
  // on AJOUTE le reflet seulement là où le métal est exposé.
  float envWeight = reflectivity * (0.35 + 0.65 * fresnelW) * u_envIntensity;
  color = mix(color, envSample, envWeight);

  gl_FragColor = vec4(color, 1.0);
}
