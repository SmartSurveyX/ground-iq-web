import { describe, expect, it } from 'vitest'
import { joinOptionText, splitOptionText } from '../src/questionOptions.js'

// The question editors say "comma-separated", but real answers contain commas
// ("Yes, and it was already there"). These tests freeze the rule that a comma
// inside quotes belongs to the option instead of starting a new one.

describe('splitOptionText', () => {
  it('splits a plain comma-separated list', () => {
    expect(splitOptionText('Yes, No, Not sure')).toEqual(['Yes', 'No', 'Not sure'])
  })

  it('keeps a comma inside double quotes in one option', () => {
    expect(splitOptionText('"Yes, and it was already there", No')).toEqual([
      'Yes, and it was already there',
      'No',
    ])
  })

  it('round-trips an option that contains a comma', () => {
    const options = ['Yes, and it was already there', 'No it was removed', "I'm not sure"]
    expect(splitOptionText(joinOptionText(options))).toEqual(options)
  })

  it("does not treat apostrophes as quotes", () => {
    expect(splitOptionText("Yes but they didn't help, No visit")).toEqual([
      "Yes but they didn't help",
      'No visit',
    ])
  })

  it('also separates on semicolons and newlines', () => {
    expect(splitOptionText('A; B\nC')).toEqual(['A', 'B', 'C'])
  })

  it('returns an empty list for blank text', () => {
    expect(splitOptionText('   ')).toEqual([])
    expect(splitOptionText(null)).toEqual([])
  })
})

describe('joinOptionText', () => {
  it('quotes only the options that need it', () => {
    expect(joinOptionText(['Yes, and it was already there', 'No'])).toBe(
      '"Yes, and it was already there", No',
    )
  })

  it('drops blanks and trims', () => {
    expect(joinOptionText([' A ', '', null, 'B'])).toBe('A, B')
  })
})
