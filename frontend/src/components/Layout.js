import { useAuth } from '../contexts/AuthContext';
import BottomNav from './BottomNav';

const Layout = ({ children }) => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <main className={isAuthenticated ? "pb-20" : ""}>
        {children}
      </main>
      {isAuthenticated && <BottomNav />}
    </div>
  );
};

export default Layout;
