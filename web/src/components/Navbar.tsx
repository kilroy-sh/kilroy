import { ThemeToggle } from './ThemeToggle';
import { AccountMenu } from './AccountMenu';
import { GitHubIcon } from './ProviderIcons';

interface NavbarProps {
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

const REPO_URL = 'https://github.com/kilroy-sh/kilroy';

export function Navbar({ children, actions }: NavbarProps) {
  return (
    <div className="omnibar-row">
      {children}
      <div className="navbar-actions">
        {actions}
        <a
          className="navbar-github"
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Kilroy on GitHub"
          aria-label="Kilroy on GitHub"
        >
          <GitHubIcon />
        </a>
        <ThemeToggle />
        <AccountMenu />
      </div>
    </div>
  );
}
