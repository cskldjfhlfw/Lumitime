import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Lock, ArrowRight, KeyRound, LogIn } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../shared/ui/dialog';
import { Button } from '../../../shared/ui/button';

interface ModuleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  route: string;
  locked?: boolean;
  index?: number;
  isLoggedIn: boolean;
}

export function ModuleCard({
  icon,
  title,
  description,
  route,
  locked = false,
  index = 0,
  isLoggedIn,
}: ModuleCardProps) {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const isActuallyLocked = locked && !isLoggedIn;

  const handleClick = () => {
    if (isActuallyLocked) {
      setDialogOpen(true);
    } else {
      navigate(route);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: index * 0.08 }}
        whileHover={!isActuallyLocked ? { y: -3 } : {}}
        onClick={handleClick}
        className={`
          group relative bg-white border rounded-lg p-6 cursor-pointer
          transition-all duration-200 select-none
          ${isActuallyLocked
            ? 'border-gray-100 opacity-70 hover:opacity-90'
            : 'border-gray-150 hover:border-gray-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)]'
          }
        `}
      >
        {/* Lock indicator */}
        {isActuallyLocked && (
          <div className="absolute top-4 right-4 text-gray-300">
            <Lock size={14} />
          </div>
        )}

        {/* Icon */}
        <div className={`
          w-10 h-10 rounded-lg flex items-center justify-center mb-4
          ${isActuallyLocked ? 'bg-gray-50 text-gray-300' : 'bg-gray-50 text-gray-700 group-hover:bg-black group-hover:text-white'}
          transition-colors duration-200
        `}>
          {icon}
        </div>

        <h3 className="text-sm font-medium text-gray-900 mb-1.5">{title}</h3>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>

        {!isActuallyLocked && (
          <div className="mt-4 flex items-center gap-1 text-xs text-gray-400 group-hover:text-black transition-colors">
            <span>进入</span>
            <ArrowRight size={12} />
          </div>
        )}
      </motion.div>

      {/* Lock dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock size={16} />
              需要登录
            </DialogTitle>
            <DialogDescription>
              <strong>{title}</strong> 仅对受邀用户开放。请登录或使用邀请码注册后访问。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button
              className="flex-1 bg-black text-white hover:bg-black/80"
              onClick={() => { setDialogOpen(false); navigate('/login'); }}
            >
              <LogIn size={14} />
              去登录
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setDialogOpen(false); navigate('/register'); }}
            >
              <KeyRound size={14} />
              邀请码注册
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
