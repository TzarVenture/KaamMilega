interface Props {
    children: React.ReactNode;
}

export default function FooterLink({ children }: Props) {
    return (
        <p className="text-gray-700 text-sm sm:text-base cursor-pointer hover:text-black transition">
            {children}
        </p>
    );
}
