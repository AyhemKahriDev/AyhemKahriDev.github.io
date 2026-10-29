import { Link, useLocation } from "react-router-dom";
import styled from "styled-components";
import { theme } from "../../styles/theme";
import { gamesData } from "../../data/gamesData";

const VAULT_LABEL = "GAMEVAULT";
const GAMES_COUNT = "50 GAMES";

export default function Navbar() {
  const location = useLocation();
  const isGameRoute = location.pathname.startsWith("/game/");
  const slug = location.pathname.replace("/game/", "");
  const game = gamesData.find((g) => g.slug === slug);

  return (
    <SNav>
      <SInner>
        <SLogo to="/">
          <SLogoMark>G</SLogoMark>
          {VAULT_LABEL}
        </SLogo>
        <SRight>
          {isGameRoute && game ? (
            <SBreadcrumb>
              <SBreadLink to="/">Games</SBreadLink>
              <SSlash>/</SSlash>
              <SBreadCurrent>{game.title}</SBreadCurrent>
            </SBreadcrumb>
          ) : (
            <SCount>{GAMES_COUNT}</SCount>
          )}
        </SRight>
      </SInner>
    </SNav>
  );
}

const SNav = styled.nav`
  width: 100%;
  background: ${theme.colors.surface};
  border-bottom: 1px solid ${theme.colors.border};
  box-shadow: 0 2px 12px rgba(35, 42, 68, 0.04);
  position: sticky;
  top: 0;
  z-index: 100;
`;

const SInner = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 ${theme.space[4]}px;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SLogo = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: ${theme.font.display};
  font-weight: 700;
  font-size: 1.1rem;
  color: ${theme.colors.text};
  letter-spacing: 0.05em;
  transition: color 150ms ease-out;
  &:hover {
    color: ${theme.colors.accent};
  }
`;

const SLogoMark = styled.span`
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.accent};
  color: #fff;
  font-size: 0.9rem;
  box-shadow: 0 5px 12px rgba(101, 88, 211, 0.22);
`;

const SRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[3]}px;
  min-width: 0;
`;

const SCount = styled.span`
  font-family: ${theme.font.mono};
  font-size: 0.7rem;
  color: ${theme.colors.textMuted};
  background: ${theme.colors.surfaceAlt};
  border: 1px solid ${theme.colors.border};
  border-radius: 999px;
  padding: 6px 10px;
  letter-spacing: 0.06em;
`;

const SBreadcrumb = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space[2]}px;
  font-family: ${theme.font.mono};
  font-size: 0.72rem;
  max-width: 45vw;
  min-width: 0;
`;

const SBreadLink = styled(Link)`
  color: ${theme.colors.textMuted};
  transition: color 150ms ease-out;
  &:hover {
    color: ${theme.colors.accent};
  }
`;

const SSlash = styled.span`
  color: ${theme.colors.border};
`;

const SBreadCurrent = styled.span`
  color: ${theme.colors.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
