import express from 'express'
import { previewRegistry } from '../state.js'
import { sendError } from '../errors.js'

const router = express.Router()

router.post('/approve', (_req, res) => {
  res.json({ status: 'ok' })
})

router.post('/preview/:id/confirm', (req, res) => {
  // remember: allow this command in this project from now on
  const remember = req.body?.remember === true
  const ok = previewRegistry.resolve(req.params.id, 'confirm', remember)
  if (!ok) return sendError(res, 404, 'NOT_FOUND', 'Preview not found')
  res.json({ status: 'ok' })
})

router.post('/preview/:id/cancel', (req, res) => {
  const ok = previewRegistry.resolve(req.params.id, 'cancel')
  if (!ok) return sendError(res, 404, 'NOT_FOUND', 'Preview not found')
  res.json({ status: 'ok' })
})

export default router
