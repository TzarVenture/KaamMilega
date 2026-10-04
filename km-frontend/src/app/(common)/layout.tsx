import AppNavbar from '@/components/km/AppNavbar'
import CommonFooter from '@/components/km/CommonFooter'
import React, { Suspense } from 'react'

const layout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div>
            <Suspense fallback={<div className="h-16 bg-white border-b border-gray-100"></div>}>
                <AppNavbar />
            </Suspense>
            {children}
            <CommonFooter />
        </div>
    )
}

export default layout