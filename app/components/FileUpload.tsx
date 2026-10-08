'use client'
import { supabase } from '../lib/supabase'
import { useState, useRef } from 'react'

export default function FileUpload({ roomId }: { roomId: string }) {
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setUploading(true)

    const { data, error } = await supabase.storage
      .from('notes')
      .upload(`${roomId}/${Date.now()}_${file.name}`, file)

    if (error) {
      alert('Upload failed: ' + error.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('notes').getPublicUrl(data.path)

    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, url: urlData.publicUrl, fileName: file.name }),
    })

    setUploading(false)
    setFileName(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        onChange={handleUpload}
        disabled={uploading}
        className="hidden"
        id="file-upload-input"
      />
      <label
        htmlFor="file-upload-input"
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition ${
          uploading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        {uploading && (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {uploading ? `Uploading${fileName ? ` ${fileName}` : ''}...` : 'Choose a file to upload'}
      </label>
    </div>
  )
}