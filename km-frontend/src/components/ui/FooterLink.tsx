interface Props {
    children: React.ReactNode;
}

export default function FooterLink({ children }: Props) {
    return (
        <p className="text-slate-300 text-sm cursor-pointer hover:text-white hover:translate-x-1 transition-all">
            {children}
        </p>
    );
}
