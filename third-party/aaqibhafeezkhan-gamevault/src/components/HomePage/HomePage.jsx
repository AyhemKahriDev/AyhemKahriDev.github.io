import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { theme } from "../../styles/theme";
import { gamesData } from "../../data/gamesData";

const CATEGORIES = [
  "All",
  "Arcade",
  "Puzzle",
  "Card",
  "Word",
  "Reflex",
  "Strategy",
];
const DIFFICULTY_COLORS = {
  Easy: theme.colors.success,
  Medium: theme.colors.warning,
  Hard: theme.colors.danger,
};
const PLACEHOLDER_BEST_KEY = "gv_best_";

function getBest(title) {
  try {
    const val = localStorage.getItem(`${PLACEHOLDER_BEST_KEY}${title}`);
    return val ? JSON.parse(val) : 0;
  } catch {
    return 0;
  }
}

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(() => {
    return gamesData.filter((g) => {
      const matchCat = category === "All" || g.category === category;
      const matchSearch =
        g.title.toLowerCase().includes(search.toLowerCase()) ||
        g.description.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [search, category]);

  return (
    <SPage>
      <SIntro>
        <SIntroCopy>
          <SEyebrow>YOUR ARCADE, YOUR WAY</SEyebrow>
          <STitle>Pick a game. Make it count.</STitle>
          <SSubtitle>Quick games, familiar classics, and small challenges whenever you want a break.</SSubtitle>
        </SIntroCopy>
        <SIntroCount>
          <SCountValue>{gamesData.length}</SCountValue>
          <SCountLabel>games to play</SCountLabel>
        </SIntroCount>
      </SIntro>

      <SControls>
        <SSearchWrap>
          <SSearchIcon>⌕</SSearchIcon>
          <SSearch
            id="game-search"
            type="text"
            placeholder="Search games..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </SSearchWrap>
        <SFilterRow>
          {CATEGORIES.map((cat) => (
            <SFilterBtn
              key={cat}
              $active={category === cat}
              $color={theme.categories[cat] || theme.colors.accent}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </SFilterBtn>
          ))}
        </SFilterRow>
      </SControls>

      <SResultsBar>
        <SResultCount>
          {filtered.length} game{filtered.length !== 1 ? "s" : ""}
        </SResultCount>
        {search && <SClear onClick={() => setSearch("")}>Clear search</SClear>}
      </SResultsBar>

      <SGrid>
        {filtered.map((game) => {
          const catColor =
            theme.categories[game.category] || theme.colors.accent;
          const best = getBest(game.title);
          return (
            <SCard
              key={game.slug}
              as={Link}
              to={`/game/${game.slug}`}
              $color={catColor}
            >
              <SCardTop>
                <SCardTitle>{game.title}</SCardTitle>
                <SDiffBadge $diff={game.difficulty}>
                  {game.difficulty}
                </SDiffBadge>
              </SCardTop>
              <SCardDesc>{game.description}</SCardDesc>
              <SCardBottom>
                <SCategoryTag $color={catColor}>{game.category}</SCategoryTag>
                <SPlayHint>Play <span>→</span></SPlayHint>
                {best > 0 && <SBestScore>BEST {best}</SBestScore>}
              </SCardBottom>
            </SCard>
          );
        })}
      </SGrid>
      {filtered.length === 0 && <SEmpty>No games match your search.</SEmpty>}
    </SPage>
  );
}

const SPage = styled.main`
  max-width: 1400px;
  margin: 0 auto;
  padding: ${theme.space[6]}px ${theme.space[4]}px ${theme.space[7]}px;
  width: 100%;
`;

const SIntro = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${theme.space[5]}px;
  padding: ${theme.space[4]}px 0 ${theme.space[5]}px;
`;

const SIntroCopy = styled.div`
  max-width: 760px;
`;

const SEyebrow = styled.div`
  font-family: ${theme.font.mono};
  font-size: 0.68rem;
  font-weight: 600;
  color: ${theme.colors.accent};
  letter-spacing: 0.14em;
  margin-bottom: ${theme.space[2]}px;
`;

const STitle = styled.h1`
  font-family: ${theme.font.display};
  font-size: clamp(2rem, 4vw, 3.25rem);
  line-height: 1.08;
  letter-spacing: -0.04em;
  color: ${theme.colors.text};
  margin-bottom: ${theme.space[2]}px;
`;

const SSubtitle = styled.p`
  color: ${theme.colors.textMuted};
  font-size: 0.98rem;
  line-height: 1.65;
  max-width: 620px;
`;

const SIntroCount = styled.div`
  min-width: 118px;
  padding: ${theme.space[3]}px ${theme.space[4]}px;
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  box-shadow: ${theme.shadows.card};
  text-align: center;
`;

const SCountValue = styled.div`
  font-family: ${theme.font.display};
  font-size: 1.7rem;
  font-weight: 700;
  color: ${theme.colors.accent};
`;

const SCountLabel = styled.div`
  color: ${theme.colors.textMuted};
  font-size: 0.68rem;
  margin-top: 2px;
`;

const SControls = styled.div`
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  padding: ${theme.space[3]}px;
  box-shadow: ${theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]}px;
  margin-bottom: ${theme.space[4]}px;
`;

const SSearchWrap = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]}px;
  background: ${theme.colors.bg};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.radius.md};
  padding: 0 ${theme.space[3]}px;
  transition: border-color 150ms ease-out, box-shadow 150ms ease-out;
  &:focus-within {
    border-color: ${theme.colors.accent};
    box-shadow: 0 0 0 3px rgba(101, 88, 211, 0.1);
  }
`;

const SSearchIcon = styled.span`
  color: ${theme.colors.textMuted};
  font-size: 1.25rem;
  line-height: 1;
`;

const SSearch = styled.input`
  width: 100%;
  background: transparent;
  border: 0;
  color: ${theme.colors.text};
  padding: ${theme.space[3]}px 0;
  font-size: 0.95rem;
  outline: none;
  &::placeholder {
    color: ${theme.colors.textMuted};
  }
`;

const SFilterRow = styled.div`
  display: flex;
  gap: ${theme.space[2]}px;
  flex-wrap: wrap;
`;

const SFilterBtn = styled.button`
  background: ${(props) =>
    props.$active ? `${props.$color}16` : theme.colors.bg};
  border: 1px solid
    ${(props) => (props.$active ? `${props.$color}66` : theme.colors.border)};
  color: ${(props) =>
    props.$active ? props.$color : theme.colors.textMuted};
  border-radius: 999px;
  padding: 7px 13px;
  font-family: ${theme.font.mono};
  font-size: 0.68rem;
  font-weight: 600;
  transition: transform 150ms ease-out, background 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out;
  &:hover {
    border-color: ${(props) => props.$color};
    color: ${(props) => props.$color};
    transform: translateY(-1px);
  }
`;

const SResultsBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 30px;
  margin-bottom: ${theme.space[2]}px;
`;

const SResultCount = styled.div`
  font-family: ${theme.font.mono};
  font-size: 0.68rem;
  color: ${theme.colors.textMuted};
  letter-spacing: 0.05em;
`;

const SClear = styled.button`
  color: ${theme.colors.accent};
  font-size: 0.72rem;
  font-weight: 600;
  &:hover {
    text-decoration: underline;
  }
`;

const SGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${theme.space[4]}px;
  @media (max-width: 1199px) {
    grid-template-columns: repeat(3, 1fr);
  }
  @media (max-width: 899px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 599px) {
    grid-template-columns: 1fr;
  }
`;

const SCard = styled.article`
  position: relative;
  overflow: hidden;
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.border};
  border-top: 3px solid ${(props) => props.$color};
  border-radius: ${theme.radius.md};
  padding: ${theme.space[4]}px;
  min-height: 176px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: ${theme.space[3]}px;
  text-decoration: none;
  box-shadow: ${theme.shadows.card};
  transition: transform 160ms ease-out, box-shadow 160ms ease-out, border-color 160ms ease-out;
  &:hover {
    transform: translateY(-3px);
    box-shadow: ${theme.shadows.cardHover};
    border-color: ${(props) => `${props.$color}55`};
  }
`;

const SCardTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${theme.space[2]}px;
`;

const SCardTitle = styled.h2`
  font-family: ${theme.font.display};
  font-weight: 650;
  font-size: 1.05rem;
  color: ${theme.colors.text};
  line-height: 1.3;
`;

const SDiffBadge = styled.span`
  font-family: ${theme.font.mono};
  font-size: 0.58rem;
  font-weight: 600;
  padding: 4px 7px;
  border-radius: 999px;
  background: ${(props) => `${DIFFICULTY_COLORS[props.$diff]}18`};
  color: ${(props) => DIFFICULTY_COLORS[props.$diff]};
  white-space: nowrap;
  flex-shrink: 0;
`;

const SCardDesc = styled.p`
  font-size: 0.82rem;
  color: ${theme.colors.textMuted};
  line-height: 1.6;
  flex: 1;
`;

const SCardBottom = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]}px;
  min-height: 18px;
`;

const SCategoryTag = styled.span`
  font-family: ${theme.font.mono};
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${(props) => props.$color};
`;

const SPlayHint = styled.span`
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 600;
  color: ${theme.colors.accent};
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 150ms ease-out, transform 150ms ease-out;
  ${SCard}:hover & {
    opacity: 1;
    transform: translateX(0);
  }
  span {
    margin-left: 2px;
  }
`;

const SBestScore = styled.span`
  font-family: ${theme.font.mono};
  font-size: 0.58rem;
  color: ${theme.colors.textMuted};
  letter-spacing: 0.06em;
`;

const SEmpty = styled.div`
  text-align: center;
  padding: ${theme.space[7]}px;
  background: ${theme.colors.surface};
  border: 1px dashed ${theme.colors.border};
  border-radius: ${theme.radius.md};
  color: ${theme.colors.textMuted};
  font-size: 0.9rem;
`;
