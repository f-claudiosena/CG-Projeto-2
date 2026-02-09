# WebGL FPS: Survival Arena - O Desafio do Patriota

Um jogo de tiro em primeira pessoa (FPS) desenvolvido puramente em **WebGL2** e **JavaScript (Vanilla)**, sem o uso de engines pesadas como Unity ou Three.js. O jogo apresenta mecânicas de física, áudio 3D espacial e renderização de modelos 3D externos.

![Screenshot](screenshot_placeholder.jpg)

## 🎮 Como Jogar

1.  **Objetivo:** Sobreviva às ondas de inimigos e acumule pontos.
2.  **Controles:**
    * **W, A, S, D:** Movimentar o personagem.
    * **Mouse:** Olhar ao redor.
    * **Clique Esquerdo (Segurar):** Carregar o tiro.
    * **Soltar Clique:** Atirar.
3.  **Mecânicas de Tiro:**
    * **Tiro Normal (Amarelo):** Dano básico. Mata inimigos normais. Some ao impactar.
    * **Tiro Forte (Vermelho):** Carregue a barra ao máximo. Causa dano em chefes e **atravessa** inimigos normais, matando vários de uma vez.
4.  **Pontuação:**
    * Inimigo Normal: **10 pontos**.
    * Super Chefe: **50 pontos**.
    * *O Chefe começa a aparecer após 100 pontos.*

## 🛠️ Tecnologias Utilizadas

* **WebGL 2.0:** Para renderização gráfica de alta performance diretamente na GPU.
* **GLSL (Shader Language):** Shaders personalizados para iluminação Phong e mapeamento de sombras (Shadow Mapping).
* **JavaScript (ES6+):** Lógica de jogo, física de colisão (AABB e Esfera), e gerenciamento de áudio.
* **gl-matrix:** Biblioteca matemática leve para operações de vetores e matrizes.

## 📂 Estrutura de Arquivos

Para que o jogo funcione corretamente, sua pasta deve conter **exatamente** estes arquivos:

```text
/
├── index.html                      # Estrutura da página, UI e Canvas
├── main.js                         # Código principal (Lógica, WebGL, Física)
├── README.md                       # Documentação (este arquivo)
│
├── ASSETS 3D (Modelos)
│   ├── cannon.obj                  # Modelo da arma do jogador
│   ├── tree.obj                    # Modelo das árvores do cenário
│   └── bolsonaro.obj               # Modelo dos inimigos (Convertido de GLB)
│
├── TEXTURAS (Imagens)
│   ├── grass.jpg                   # Textura do chão
│   ├── tree.jpg                    # Textura das árvores
│   ├── wall.png                    # Textura das paredes (Tijolos)
│   └── bolsonaro.jpg               # Textura do inimigo
│
└── ÁUDIO (Sons)
    ├── taok.mp3                    # Fala do inimigo normal
    ├── ninguem-pega-meu-telefone.mp3 # Fala do chefe (vivo)
    └── pegaram-meu-telefone.mp3    # Fala do chefe (morrendo)