<?php if(!defined('KIRBY')) exit ?>

title: Band
pages: false
files: true
fields:
  title:
    label: Titel
    type: text
  genre:
    label: Genre
    type:  text
  description:
    label: Beschreibung
    type:  textarea
  stagetimes:
    label: Auftritte
    type: structure
    fields:
      year:
        label: Jahr
        type: select
        options:
          2010: 2010
          2011: 2011
          2012: 2012
          2013: 2013
          2014: 2014
        default: 2014
        required: true
      day:
        label: Tag
        type: select
        options:
          Freitag: Freitag
          Samstag: Samstag
          Sonntag: Sonntag
        required: true
      time:
        label: Uhrzeit
        type: time
        required: true
      stage:
        label: Bühne
        type: select
        options:
          GB: Große Bühne
          KB: Kleine Bühne
          WB: Waldbühne
          A: Aula
          DJ: DJ-Eck
        required: true
    entry: >
      {{year}}: {{day}} {{time}} {{stage}}
  facebook:
    label: Facebook
    type: url
  soundcloud:
    label: Soundcloud
    type: url
  youtube:
    label: YouTube
    type: url
  website:
    label: Website
    type: url
  twitter:
    label: Twitter
    type: url
    