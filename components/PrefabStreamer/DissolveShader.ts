import * as THREE from 'three';

export const DissolveShader = {
    uniforms: {
        'u_dissolve_threshold': { value: 1.0 },
        'u_noise_texture': { value: null },
        'u_base_texture': { value: null },
        'u_base_color': { value: new THREE.Color(0xffffff) },
        'u_dissolve_edge_color': { value: new THREE.Color(0x00ffff) },
        'u_dissolve_edge_width': { value: 0.1 },
    },

    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        uniform sampler2D u_noise_texture;
        uniform sampler2D u_base_texture;
        uniform vec3 u_base_color;
        uniform float u_dissolve_threshold;
        uniform vec3 u_dissolve_edge_color;
        uniform float u_dissolve_edge_width;

        varying vec2 vUv;

        void main() {
            vec4 baseTexColor = texture2D(u_base_texture, vUv);
            
            // If the base texture has transparency, respect it
            if (baseTexColor.a < 0.1) {
                discard;
            }

            float noiseValue = texture2D(u_noise_texture, vUv).r;

            // Discard pixels below the threshold
            if (noiseValue < u_dissolve_threshold) {
                discard;
            }

            // Calculate the edge glow
            float edgeProximity = 1.0 - smoothstep(u_dissolve_threshold, u_dissolve_threshold + u_dissolve_edge_width, noiseValue);
            
            // Combine base color with texture color
            vec3 finalColor = u_base_color * baseTexColor.rgb;

            // Mix in the edge color based on proximity
            finalColor = mix(finalColor, u_dissolve_edge_color, edgeProximity);

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};