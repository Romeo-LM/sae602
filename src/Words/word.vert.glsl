// ─── Word vertex ─────────────────────────────────────────────────────────────
// PlaneGeometry standard. Le mesh fait lookAt(camera) en JS chaque frame, donc
// le plan est déjà orienté face-caméra. Pas de billboard custom.
// v_worldY est la vraie coordonnée monde du fragment (utilisé pour discard).

varying vec2  vUv;
varying float v_worldY;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  v_worldY = worldPos.y;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
