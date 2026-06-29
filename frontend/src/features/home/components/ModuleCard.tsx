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
          group relative min-h-[168px] cursor-pointer select-none rounded-lg border bg-white/82 p-5
          transition-all duration-200
          ${isActuallyLocked
            ? 'border-[#e8e5dc] opacity-72 hover:opacity-95'
            : 'border-[#e8e5dc] hover:-translate-y-0.5 hover:border-[#d7d2c7] hover:shadow-[0_18px_48px_rgba(20,20,20,0.07)]'
          }
        `}
      >
        {/* Lock indicator */}
        {isActuallyLocked && (
          <div className="absolute right-4 top-4 text-[#b8b3a8]">
            <Lock size={14} />
          </div>
        )}

        {/* Icon */}
        <div className={`
          mb-5 flex h-10 w-10 items-center justify-center rounded-md border
          ${isActuallyLocked ? 'border-[#ebe7dd] bg-[#f8f7f3] text-[#b8b3a8]' : 'border-[#ebe7dd] bg-[#f8f7f3] text-[#56544f] group-hover:border-[#171717] group-hover:bg-[#171717] group-hover:text-white'}
          transition-colors duration-200
        `}>
          {icon}
        </div>

        <h3 className="mb-2 text-sm font-medium text-[#171717]">{title}</h3>
        <p className="text-xs leading-6 text-[#6f6d67]">{description}</p>

        {!isActuallyLocked && (
          <div className="mt-5 flex items-center gap-1 text-xs text-[#9b978d] transition-colors group-hover:text-[#171717]">
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
              className="flex-1 bg-[#161616] text-white hover:bg-black"
              onClick={() => { setDialogOpen(false); navigate('/login'); }}
            >
              <LogIn size={14} />
              去登录
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-[#dedad0]"
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
