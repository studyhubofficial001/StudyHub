import React from 'react'
import bookImage from '../assets/book.jpeg'

const SideTemplate = () => {
  return (
    <div>
      <div className="hidden md:flex md:px-8 h-0 md:h-screen flex-col items-center bg-black">
          <h1 className='text-white flex justify-center md:text-5xl font-bold md:pt-15 italic'>
            Study<span className='text-teal-700'>Hub</span>
          </h1>
          <p className='text-gray-300 md:text-xl md:pt-8'>
            One place for your year's notes, past papers, group discussion and instant answers from every PDF you upload.
          </p>
          <div className="md:pt-20">
          <img src={bookImage} alt="book" className="h-auto w-full max-h-[60vh] object-contain opacity-70 select-none" />
          </div>
        </div>
    </div>
  )
}

export default SideTemplate
