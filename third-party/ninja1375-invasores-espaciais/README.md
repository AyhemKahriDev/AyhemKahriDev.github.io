# 🛸 Invasores Espaciais

Um remake moderno do clássico jogo **Space Invaders**, desenvolvido com **HTML5 Canvas**, **CSS3** e **JavaScript puro**.  
Totalmente responsivo, compatível com dispositivos móveis e com controles otimizados tanto para teclado como para touch screen.

---

## 🧩 Funcionalidades

- Jogabilidade clássica com gráficos em **Canvas 2D**
- Sistema de **pontuação, vidas e níveis progressivos**
- Suporte para **controles de teclado** (←, →, espaço, Enter, P)
- **Controles tácteis** otimizados para dispositivos móveis
- **Efeitos visuais** de explosão e feedback de colisão
- Sistema de **pausa** e **reinício**
- Interface moderna com **responsividade completa**
- FPS estável (controlado por `requestAnimationFrame`)

---

## 🕹️ Controle do Jogo

### 💻 No computador:
- **← / →** — mover a nave  
- **Espaço / X** — disparar  
- **Enter** — iniciar jogo  
- **P** — pausar ou continuar  

### 📱 No celular:
- Botões virtuais na tela:
  - **←** e **→** para mover  
  - **FOGO** para disparar  

---

## 🧠 Tecnologias Utilizadas

<a href="https://programartudo.blogspot.com/2024/11/html-tudo-o-que-precisa-para-comecar.html" target="_blank"><img loading="lazy" src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg" width="40" height="40"/></a> <a href="https://programartudo.blogspot.com/2024/11/css-como-dar-estilo-ao-teu-website.html" target="_blank"><img loading="lazy" src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg" width="40" height="40"/></a> <a href="https://programartudo.blogspot.com/2024/11/javascript-linguagem-dinamica-da-web.html" target="_blank"><img loading="lazy" src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" width="40" height="40"/></a>

- **HTML5** — estrutura e canvas do jogo  
- **CSS3** — interface, animações e design responsivo  
- **JavaScript (ES6)** — lógica de jogo, renderização, colisões e eventos  

---

## 📁 Estrutura de Arquivos

/

├── index.html # Estrutura principal do jogo

├── style.css # Estilo visual e design responsivo

├── script.js # Lógica e mecânica do jogo

└── README.md # Documentação do projeto

---

## 🚀 Como Executar Localmente

1. **Faz o clone** do repositório:
   ```bash
   git clone https://github.com/Ninja1375/invasores-espaciais.git
   ```
2. Abre o projeto:
   ```bash
   cd invasores-espaciais
   ```
3. Executa o jogo:

Abre o arquivo `index.html` no navegador

(opcional) Usa uma extensão de servidor local como “Live Server” para melhor desempenho

---

## 🧱 Estrutura do Código

A classe principal `SpaceInvadersGame` é responsável por:

- Configurar o canvas e gerir FPS

- Renderizar elementos (tanque, inimigos, balas)

- Controlar eventos de teclado e toque

- Detetar colisões e gerir pontuação

- Criar efeitos de explosão com partículas

---

## 🌟 Créditos

Desenvolvido por **[Antônio Nascimento](https://portfolio-antonio-nascimento.netlify.app/)**
Inspirado no clássico Space Invaders (1978)
