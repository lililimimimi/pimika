import { test, expect } from '@playwright/test'
import { mockBackend } from './fixtures'

test.describe('sidebar on narrow windows', () => {
  test('starts closed on a narrow window and opens with the button', async ({ page }) => {
    await mockBackend(page, { reply: () => 'unused' })
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto('/')

    await expect(page.getByRole('button', { name: 'Show Sidebar (⌘B)' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hide Sidebar (⌘B)' })).toHaveCount(0)
  })

  test('closes when the window shrinks to a narrow width', async ({ page }) => {
    await mockBackend(page, { reply: () => 'unused' })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Hide Sidebar (⌘B)' })).toBeVisible()

    await page.setViewportSize({ width: 390, height: 800 })

    await expect(page.getByRole('button', { name: 'Show Sidebar (⌘B)' })).toBeVisible()
  })
})
