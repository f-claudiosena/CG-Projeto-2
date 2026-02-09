# WebGL FPS: Survival Arena - O Desafio do Patriota 🇧🇷

Um jogo de tiro em primeira pessoa (FPS) desenvolvido **do zero** utilizando **WebGL 2.0** e **JavaScript (Vanilla)**. Este projeto demonstra um motor gráfico customizado sem o uso de bibliotecas de alto nível (como Three.js ou Unity), focando na implementação manual de shaders GLSL, física e matemática vetorial.

![Status do Projeto](https://img.shields.io/badge/Status-Desenvolvimento-green) ![WebGL](https://img.shields.io/badge/WebGL-2.0-blue)

## 🌟 Novas Funcionalidades Gráficas (Update Recente)

O motor gráfico foi atualizado para suportar técnicas de renderização avançadas:

* **🌤️ Skybox (Cubemap):** Renderização de ambiente cúbico para criar um céu imersivo.
* **🌓 Ciclo Dia & Noite Dinâmico:** O sol e a lua orbitam a cena, alterando a cor da luz ambiente, a direção das sombras e a tonalidade do céu (tint) em tempo real.
* **💡 Iluminação Phong:** Implementação completa do modelo de iluminação Phong (Componentes Ambiental, Difusa e Especular) nos Fragment Shaders.
* **🌑 Shadow Mapping:** Sombras dinâmicas projetadas em tempo real baseadas na posição dos corpos celestes.
* **🧱 Normal Mapping:** Cálculo de perturbação de normais via derivadas (`dFdx`, `dFdy`) para adicionar detalhes de relevo nas superfícies sem aumentar a geometria.
* **🎨 Suporte a Materiais (.MTL):** O loader agora interpreta arquivos `.mtl` para aplicar cores e texturas específicas aos modelos `.obj`.

## 🎮 Gameplay e Mecânicas

1.  **Objetivo:** Sobreviva a ondas infinitas de inimigos e alcance a maior pontuação possível.
2.  **Arma (Faca de Arremesso):**
    * O jogador empunha uma faca tática modelada em 3D.
    * **Mecânica de Carga:** Segure o clique esquerdo para carregar a força do arremesso.
    * **Física de Projéteis:** Os disparos sofrem ação da gravidade e colidem com o cenário.
3.  **Inimigos:**
    * Inteligência artificial básica que persegue o jogador.
    * Diferentes tipos: Normal, Mini (Rápido) e Super Chefe (Lento e Resistente).
4.  **Sistema de Vida e Score:** Persistência de recordes via `localStorage`.

## 🕹️ Controles

| Tecla / Ação | Função |
| :--- | :--- |
| **W, A, S, D** | Movimentação do Personagem |
| **Mouse** | Olhar / Mirar |
| **Clique Esquerdo (Segurar)** | Carregar força do disparo |
| **Clique Esquerdo (Soltar)** | Atirar/Arremessar |
| **Espaço** | Pular (Física com gravidade) |

## 📂 Estrutura de Arquivos Necessária

Para rodar o jogo, certifique-se de que sua pasta possui a seguinte estrutura e os assets (modelos/texturas) corretos:

```text
/
├── index.html                  # Entry point e Interface (HUD)
├── main.js                     # Lógica principal, Game Loop e WebGL Context
├── obj-loader.js               # Parser customizado para arquivos .OBJ e .MTL
├── shaders.js                  # (Opcional se inline no main) Código GLSL
├── README.md                   # Documentação
│
├── assets
│   ├── cannon.obj              # Modelo 3D da Faca/Arma
│   ├── cannon.mtl              # Material da Faca
│   ├── tree.obj                # Modelo das árvores
│   ├── tree.mtl                # Material das árvores
│   ├── bolsonaro.obj           # Modelo do inimigo
│   └── heart.obj               # Modelo do item de vida
│
├── textures
│   ├── grass.jpg               # Chão
│   ├── wall.png                # Paredes
│   ├── bolsonaro.jpg           # Textura do inimigo
│   ├── tree.jpg                # Textura da árvore
│   │
│   └── skybox
│       ├── sky_right.jpg
│       ├── sky_left.jpg
│       ├── sky_top.jpg
│       ├── sky_bottom.jpg
│       ├── sky_front.jpg
│       └── sky_back.jpg
│
└── sfx
    ├── gun-fire.mp3                    # Som de disparo
    ├── taok.mp3                        # Som do inimigo
    └── ninguem-pega-meu-telefone.mp3   # Som do inimigo maior
    └── pegaram-meu-telefone.mp3        # Som de morte do inimigo maior
    └── problema-o-tempo-todo.mp3       # Som do inimigo menor
    └── canalhas-canalhas.mp3           # Som de morte do inimigo menor
```

## 💡 Como fazer rodar?
Passo a passo simples:
1. Clonar o repositório git
   ```
   git clone https://github.com/f-claudiosena/CG-Projeto-2.git
   ```
2. Acessar a raiz do projeto
   ```
   /CG-Projeto-2/
   ```
3. Subir o servidor local (utilizamos python no exemplo)
   ```
   python -m http.server 8000
   ```
4. Agora é só abrir no navegador na porta que subiu o projeto
   ```
   http://localhost:8000
   ```
5. Agora é só pontuar e se divertir!

## Vídeo de apresentacão do jogo
```
https://drive.google.com/file/d/1plNJCiY6wKotMk2PAAWo0i-VCebKiCV4/view?usp=sharing
```

## 📄 Licença
Este projeto é fornecido como material educacional.

## 👨‍💻 Autor
Francisco Cláudio da Silva Sena Filho
Desenvolvido como trabalho prático de Computação Gráfica.
